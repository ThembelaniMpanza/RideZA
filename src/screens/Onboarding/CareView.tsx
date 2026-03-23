import React, { useRef } from 'react';
import { StyleSheet, Text, Animated, useWindowDimensions } from 'react-native';
import { AppImages } from '../../../assets';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  animationController: React.RefObject<Animated.Value>;
}

const IMAGE_WIDTH = 350;
const IMAGE_HEIGHT = 350;

const CareView: React.FC<Props> = ({ animationController }) => {
  const window = useWindowDimensions();
  const { colors } = useTheme();

  const careRef = useRef<Text | null>(null);

  const slideAnim = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [window.width, window.width, 0, -window.width, -window.width],
  });

  const careEndVal = 26 * 2; // 26 being text's height (font size)
  const careAnim = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [careEndVal, careEndVal, 0, -careEndVal, -careEndVal],
  });

  const imageEndVal = IMAGE_WIDTH * 4;
  const imageAnim = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [imageEndVal, imageEndVal, 0, -imageEndVal, -imageEndVal],
  });

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: slideAnim }] }]}
    >

      <Animated.Text
        style={[
          styles.title,
          { color: colors.text, transform: [{ translateX: careAnim }] },
        ]}
        ref={careRef}
      >
        We Care 
      </Animated.Text>
      <Animated.Image
        style={[styles.image, { transform: [{ translateX: imageAnim }] }]}
        source={AppImages.care_image}
      />
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        24/7 CustomerCare & Support, real people, ready to assist you anytime.
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 100,
  },
  image: {
    maxWidth: IMAGE_WIDTH,
    maxHeight: IMAGE_HEIGHT,
  },
  title: {
    color: 'black',
    fontSize: 26,
    textAlign: 'center',
    fontFamily: 'WorkSans-Bold',
  },
  subtitle: {
    color: 'black',
    textAlign: 'center',
    fontFamily: 'WorkSans-Regular',
    paddingHorizontal: 64,
    paddingVertical: 16,
  },
});

export default CareView;
